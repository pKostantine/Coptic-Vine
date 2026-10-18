import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { VineDivider } from './Ornaments';

export interface NoticeAction {
  label: string;
  onPress: () => void;
  /** The gold button; the rest are outlined. */
  primary?: boolean;
}

interface NoticeScreenProps {
  title: string;
  body?: string;
  /** A small muted line under the body — the address that failed, an error's own words. Selectable, so it can be copied into a report. */
  detail?: string | null;
  actions?: NoticeAction[];
  arabic?: boolean;
}

/**
 * A whole screen given over to one message (Coptic Vine design, after the Home
 * hero): the seal, the vine, a title and a line or two, then the ways out.
 * It is what the app shows in place of a page it cannot show — a link that
 * leads nowhere, a page that crashed — so it takes only strings and callbacks
 * and leans on nothing that might itself be broken.
 */
export default function NoticeScreen({ title, body, detail, actions = [], arabic = false }: NoticeScreenProps) {
  const insets = useSafeAreaInsets();
  // Scrolls when it is taller than the screen -- a phone on its side is
  // shorter than the seal, the message and its buttons -- so nothing is pushed
  // under the home indicator; and it keeps clear of every edge's inset.
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, {
        paddingBottom: 24 + insets.bottom,
        paddingTop: 24 + insets.top,
        paddingLeft: 24 + insets.left,
        paddingRight: 24 + insets.right,
      }]}
      bounces={false}
    >
      <View style={styles.column}>
        <Image
          accessible
          accessibilityLabel="Coptic Vine"
          source={require('../../../../assets/images/coptic-vine-seal-screen.png')}
          style={styles.seal}
        />
        <View style={styles.divider} pointerEvents="none">
          <VineDivider width={200} height={26} />
        </View>
        <Text style={[styles.title, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        {body ? (
          <Text style={[styles.body, arabic && styles.arabic]} maxFontSizeMultiplier={1.3}>
            {body}
          </Text>
        ) : null}
        {detail ? (
          <Text style={styles.detail} selectable maxFontSizeMultiplier={1.2}>
            {detail}
          </Text>
        ) : null}
        {actions.length ? (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                onPress={action.onPress}
                style={({ pressed }) => [action.primary ? styles.primary : styles.secondary, pressed && styles.pressed]}
              >
                <Text style={[action.primary ? styles.primaryText : styles.secondaryText, arabic && styles.arabicTight]} maxFontSizeMultiplier={1.3}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COLORS.black, flex: 1 },
  content: { alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  column: { alignItems: 'center', maxWidth: 420, width: '100%' },
  seal: { height: 112, resizeMode: 'contain', width: 112 },
  divider: { marginBottom: 18, marginTop: 14 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 26, fontWeight: '700', lineHeight: 32, textAlign: 'center' },
  body: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  detail: { color: 'rgba(205, 216, 203, 0.6)', fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 26 },
  primary: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 12, justifyContent: 'center', minHeight: 48, paddingHorizontal: 18 },
  primaryText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.title, fontSize: 16, fontWeight: '700' },
  secondary: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 18 },
  secondaryText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic },
});
