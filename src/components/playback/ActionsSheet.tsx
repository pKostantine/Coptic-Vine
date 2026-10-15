'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon, { type IconName } from '@/components/vine/ui/Icon';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';

import { tr } from '../../utils/appText';

/**
 * The sheet of actions a row offers — a track's, a lesson's — rising from the
 * bottom over a dimmed page: the item it is about across the top, then its
 * rows. Music and Learn & Study share it so a queue holding both kinds offers
 * them the same way.
 */

interface ActionsMenuTriggerProps {
  label: string;
  size: number;
  onPress: () => void;
}

/** The "⋮" that opens the sheet, sized to the row it sits in. */
export function ActionsMenuTrigger({ label, size, onPress }: ActionsMenuTriggerProps) {
  return (
    <Pressable
      accessible={false}
      accessibilityLabel={label}
      hitSlop={4}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.trigger,
        { width: size, height: size, borderRadius: size / 2 },
        hovered && styles.triggerHovered,
        pressed && styles.triggerPressed,
      ]}
    >
      <Icon name="ellipsis-vertical" size={Math.max(20, Math.round(size * 0.56))} color={COLORS.muted} />
    </Pressable>
  );
}

interface ActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  /** The item's picture, drawn beside its name. */
  artwork: ReactNode;
  title: string;
  subtitle?: string | null;
  isArabic?: boolean;
  children: ReactNode;
}

export default function ActionsSheet({ visible, onClose, closeLabel, artwork, title, subtitle, isArabic = false, children }: ActionsSheetProps) {
  if (!visible) return null;
  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel={closeLabel} style={styles.backdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            {artwork}
            <View style={styles.sheetHeaderText}>
              <Text numberOfLines={1} style={[styles.title, isArabic && styles.arabic]}>{title}</Text>
              {subtitle ? (
                <Text numberOfLines={1} style={[styles.subtitle, isArabic && styles.arabic]}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Fermer', 'إغلاق')} onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Icon name="close" size={20} color={COLORS.muted} />
            </Pressable>
          </View>
          <View style={styles.actions}>{children}</View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

interface ActionRowProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** The icon's colour: the gold of Music, the teal of Learn & Study. */
  accentColor?: string;
}

export function ActionRow({ icon, label, onPress, accentColor = COLORS.goldBright }: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
    >
      <Icon name={icon} size={20} color={accentColor} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 1,
  },
  triggerHovered: { backgroundColor: COLORS.goldSoft, borderColor: COLORS.goldLine },
  triggerPressed: { backgroundColor: COLORS.goldSoft, opacity: 0.78 },
  pressed: { opacity: 0.7 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
    backgroundColor: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopLeftRadius: RADII.lg,
    borderTopRightRadius: RADII.lg,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 9,
    marginBottom: SPACING.md,
  },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
  sheetHeaderText: { flex: 1, minWidth: 0 },
  closeButton: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.title,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 12,
    marginTop: 3,
  },
  actions: {
    marginTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.xs,
  },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
  },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  actionText: {
    flex: 1,
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '700',
  },
  arabic: {
    fontFamily: TYPOGRAPHY.arabic,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
