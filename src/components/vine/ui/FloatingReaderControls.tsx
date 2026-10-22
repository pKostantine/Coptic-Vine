'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { DocumentTheme } from '../../../constants/documentThemes';
import { TYPOGRAPHY } from '../../../constants/theme';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { appText, appTextIsArabic, type AppText } from '../../../utils/appText';
import { formatEnglishDisplayText } from '../../../utils/displayText';
import { floatingControlsColors, type FloatingControlsLayout, type FloatingReader } from './floatingControls';
import Icon, { type IconName } from './Icon';

export interface FloatingAction {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}

interface FloatingReaderControlsProps {
  theme: DocumentTheme;
  reader: FloatingReader;
  layout: FloatingControlsLayout;
  onBack: () => void;
  backAccessibilityLabel?: string;
  /** The title pill. None, and the page carries its own title (a service's headpiece). */
  title?: string | AppText;
  /** Whether the title pill shows: it fades in and out. */
  titleVisible?: boolean;
  /** Tapping the title opens something (the Bible's verse list); it then wears a chevron. */
  onTitlePress?: () => void;
  titleAccessibilityLabel?: string;
  /** The right-hand capsule's buttons: one is a round capsule of its own, more share one. */
  actions: FloatingAction[];
}

/** Each button in a shared capsule, and its glyph. */
const ACTION = 36;
const ACTION_ICON = 19;

/**
 * The controls that float over a page being read, in place of a bar above it:
 * a round Back, a title pill in the middle, and the page's own buttons on the
 * right (the full-screen toggle and the contents). Each is a capsule of the
 * page's own colour, a little see-through and blurred where the browser can,
 * with a hairline edge and a soft shadow, so the page reads as running right
 * up under them. The screens keep their text clear of the row and fade it out
 * beneath it (floatingControls.ts's contentTop, and the documents' own fade).
 */
export default function FloatingReaderControls({
  theme,
  reader,
  layout,
  onBack,
  backAccessibilityLabel = 'Go back',
  title,
  titleVisible = true,
  onTitlePress,
  titleAccessibilityLabel,
  actions,
}: FloatingReaderControlsProps) {
  const { preferences } = useReadingPreferences();
  const colors = floatingControlsColors(theme, reader);
  const [opacity] = useState(() => new Animated.Value(titleVisible ? 1 : 0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: titleVisible ? 1 : 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [opacity, titleVisible]);

  const titleParts = typeof title === 'string' ? { english: title, arabic: '' } : title;
  // One language at a time, as AppHeader: the app-wide choice, falling back to
  // whichever one this particular title actually has.
  const showArabic = Boolean(titleParts && appTextIsArabic(titleParts, preferences.appLanguage));
  const label = !titleParts ? '' : showArabic ? titleParts.arabic : formatEnglishDisplayText(appText(titleParts, preferences.appLanguage));

  const capsule: ViewStyle = {
    alignItems: 'center',
    backgroundColor: colors.capsule,
    borderColor: colors.hairline,
    borderRadius: layout.size / 2,
    borderWidth: 1,
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.18)',
    flexDirection: 'row',
    height: layout.size,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(14px) saturate(1.4)' } as ViewStyle) : null),
  };
  const round: ViewStyle = { width: layout.size };
  const shared = actions.length > 1;
  // The title stays centred on the screen, clear of whichever side is wider.
  const actionsWidth = shared ? actions.length * ACTION + (actions.length - 1) * 2 + 12 : layout.size;
  const titleInset = Math.max(layout.size, actions.length ? actionsWidth : 0) + 8;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { height: layout.contentTop }]}>
      <View
        pointerEvents="box-none"
        style={[styles.row, { top: layout.top, left: layout.left, right: layout.right, height: layout.size }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          hitSlop={6}
          style={({ pressed }) => [capsule, round, pressed && styles.pressed]}
          onPress={onBack}
        >
          <Icon name="chevron-back" size={20} color={colors.icon} />
        </Pressable>

        {label ? (
          <Animated.View
            pointerEvents={titleVisible ? 'box-none' : 'none'}
            style={[styles.titleLayer, { left: titleInset, right: titleInset, opacity }]}
          >
            <Pressable
              accessibilityRole={onTitlePress ? 'button' : 'header'}
              accessibilityLabel={titleAccessibilityLabel}
              disabled={!onTitlePress}
              style={({ pressed }) => [capsule, styles.titlePill, pressed && styles.pressed]}
              onPress={onTitlePress}
            >
              <Text
                numberOfLines={1}
                style={[styles.title, { color: colors.text }, showArabic && styles.arabicTitle]}
              >
                {label}
              </Text>
              {onTitlePress ? <Icon name="chevron-down" size={13} color={colors.icon} /> : null}
            </Pressable>
          </Animated.View>
        ) : null}

        <View style={styles.spacer} pointerEvents="none" />

        {actions.length ? (
          <View style={[capsule, shared ? styles.sharedCapsule : round]}>
            {actions.map((action) => (
              <Pressable
                key={action.accessibilityLabel}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                hitSlop={shared ? 2 : 6}
                style={({ pressed }) => [shared ? styles.sharedAction : styles.fill, pressed && styles.pressed]}
                onPress={action.onPress}
              >
                <Icon name={action.icon} size={shared ? ACTION_ICON : 20} color={colors.icon} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Over the top of the page; only the capsules take a touch.
  layer: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 10 },
  row: { alignItems: 'center', flexDirection: 'row', position: 'absolute' },
  spacer: { flex: 1 },
  titleLayer: { alignItems: 'center', bottom: 0, justifyContent: 'center', position: 'absolute', top: 0 },
  titlePill: { gap: 7, maxWidth: '100%', paddingHorizontal: 18 },
  title: { flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700' },
  arabicTitle: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  sharedCapsule: { gap: 2, paddingHorizontal: 6 },
  sharedAction: { alignItems: 'center', borderRadius: ACTION / 2, height: ACTION, justifyContent: 'center', width: ACTION },
  fill: { alignItems: 'center', alignSelf: 'stretch', flex: 1, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
