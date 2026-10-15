import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import Icon, { type IconName } from '@/components/vine/ui/Icon';
import { COLORS } from '@/constants/theme';

import ActionSheetFrame, { SheetHeader, SheetRow, SheetRowGroup } from './ActionSheetFrame';

/**
 * The sheet of actions a row offers — a track's, a lesson's — over a dimmed
 * page (Coptic Vine Player design, "More menu"): the item it is about across
 * the top, its artwork, a gold kicker and its name, then its rows. Music and
 * Learn & Study share it so a queue holding both kinds offers them the same
 * way, and a row that opens more (Add to playlist) swaps the rows for its own
 * content in the same sheet rather than stacking a second one on top.
 */

interface ActionsMenuTriggerProps {
  label: string;
  size: number;
  onPress: () => void;
}

/** The "⋯" that opens the sheet, sized to the row it sits in. */
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
      {/* The design's "more": a horizontal ellipsis, 19pt on a row. */}
      <Icon name="ellipsis-horizontal" size={Math.max(19, Math.round(size * 0.5))} color={COLORS.muted} />
    </Pressable>
  );
}

interface ActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  /** The item's picture, drawn beside its name (52 square, 10 round). */
  artwork: ReactNode;
  title: string;
  /** The gold line over the title: the release a track is from, or what the sheet is doing. */
  subtitle?: string | null;
  /** Kept for the menus that pass it: the sheet sets Arabic by the text itself. */
  isArabic?: boolean;
  /**
   * Whether the children are rows, set out as the menu's list. Content that
   * brings its own headings (a playlist picker) passes false.
   */
  rows?: boolean;
  children: ReactNode;
}

export default function ActionsSheet({ visible, onClose, closeLabel, artwork, title, subtitle, rows = true, children }: ActionsSheetProps) {
  return (
    <ActionSheetFrame visible={visible} onClose={onClose} closeLabel={closeLabel}>
      <SheetHeader artwork={artwork} kicker={subtitle} title={title} />
      {rows ? <SheetRowGroup first>{children}</SheetRowGroup> : children}
    </ActionSheetFrame>
  );
}

interface ActionRowProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** The icon's colour; gold unless a row asks otherwise. */
  accentColor?: string;
}

/** A menu row that goes somewhere or does something: its icon on a gold tile, its label, a chevron. */
export function ActionRow({ icon, label, onPress, accentColor = COLORS.gold }: ActionRowProps) {
  return <SheetRow icon={icon} label={label} onPress={onPress} iconColor={accentColor} trailing="chevron" />;
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
});
