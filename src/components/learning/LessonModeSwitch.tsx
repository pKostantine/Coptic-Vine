'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import PlayerIcon from '@/components/playback/PlayerIcon';
import { PLAYER_INK } from '@/components/playback/PlayerParts';
import { COLORS, RADII, TYPOGRAPHY } from '@/constants/theme';
import type { LessonVideoMode } from '@/utils/lessonPlayback';

import { tr } from '../../utils/appText';

/** The switch's height, which the player's compositions leave room for. */
export const LESSON_MODE_SWITCH_HEIGHT = 36;

/**
 * Video or Audio only, for lessons with a picture: one choice for every
 * lesson, kept on the device. Switching keeps the lesson playing at the same
 * place; Audio only plays the small audio copy, so it saves data.
 */
export default function LessonModeSwitch({
  mode,
  onChange,
  variant = 'player',
  isArabic = false,
}: {
  mode: LessonVideoMode;
  onChange: (mode: LessonVideoMode) => void;
  /** Over the player's backdrop, or on a lesson's page. */
  variant?: 'player' | 'page';
  isArabic?: boolean;
}) {
  const options: { value: LessonVideoMode; icon: 'videocam-outline' | 'headset-outline'; label: string }[] = [
    { value: 'video', icon: 'videocam-outline', label: tr('Video', 'Vidéo', 'فيديو') },
    { value: 'audio', icon: 'headset-outline', label: tr('Audio only', 'Audio seulement', 'صوت فقط') },
  ];
  return (
    <View accessibilityRole="tablist" style={[styles.track, variant === 'page' && styles.trackPage]}>
      {options.map((option) => {
        const on = mode === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            onPress={() => { if (!on) onChange(option.value); }}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.option,
              on && styles.optionOn,
              hovered && !on && styles.optionHovered,
              pressed && !on && styles.pressed,
              Platform.OS === 'web' && styles.webCursor,
            ]}
          >
            <PlayerIcon name={option.icon} size={15} color={on ? PLAYER_INK : 'rgba(255, 255, 255, 0.78)'} />
            <Text numberOfLines={1} style={[styles.label, on && styles.labelOn, isArabic && styles.arabic]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    alignSelf: 'center',
    flexDirection: 'row',
    height: LESSON_MODE_SWITCH_HEIGHT,
    padding: 3,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  trackPage: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.goldLine },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 104,
    paddingHorizontal: 14,
    borderRadius: RADII.pill,
  },
  optionOn: { backgroundColor: COLORS.gold },
  optionHovered: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  pressed: { opacity: 0.7 },
  webCursor: { cursor: 'pointer' } as object,
  label: { color: 'rgba(255, 255, 255, 0.78)', fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '800' },
  labelOn: { color: PLAYER_INK },
  arabic: { fontFamily: TYPOGRAPHY.arabic },
});
