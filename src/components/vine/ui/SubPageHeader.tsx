import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { useLayoutMode } from '../../../utils/useLayoutMode';
import Icon from './Icon';

interface SubPageHeaderProps {
  title: string;
  arabic: boolean;
  onBack: () => void;
  backLabel: string;
  /** A 25pt title on a phone (Downloads & Storage's board) rather than the 28pt of Seasons and Saint Hymns. */
  compact?: boolean;
  /** At the far end of the header: the spiritual canon's Edit button. */
  trailing?: ReactNode;
}

/** A page reached from another (Coptic Vine design, "Seasons"): a round gold back button, then the page's title. */
export default function SubPageHeader({ title, arabic, onBack, backLabel, compact = false, trailing }: SubPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const phone = useLayoutMode() === 'phone';
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={6} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Icon name="chevron-back" size={22} color={COLORS.gold} />
      </Pressable>
      <Text style={[styles.title, compact && phone && styles.titlePhone, arabic && styles.arabic]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 14, paddingHorizontal: 16 },
  back: {
    alignItems: 'center',
    borderColor: COLORS.goldLine,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 28, fontWeight: '700' },
  titlePhone: { fontSize: 25 },
  trailing: { marginLeft: 'auto' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  pressed: { opacity: 0.7 },
});
