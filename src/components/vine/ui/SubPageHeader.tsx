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
}

/** A page reached from another (Coptic Vine design, "Seasons"): a round gold back button, then the page's title -- 25pt on a phone, 28pt wider. */
export default function SubPageHeader({ title, arabic, onBack, backLabel }: SubPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const phone = useLayoutMode() === 'phone';
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }, arabic && styles.rowReverse]}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={6} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Icon name={arabic ? 'chevron-forward' : 'chevron-back'} size={22} color={COLORS.gold} />
      </Pressable>
      <Text style={[styles.title, phone && styles.titlePhone, arabic && styles.arabic]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 14, paddingHorizontal: 16 },
  rowReverse: { flexDirection: 'row-reverse' },
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
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  pressed: { opacity: 0.7 },
});
