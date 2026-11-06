'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { tr } from '@/utils/appText';

const MAX_FONT_SCALE = 1.3;

/**
 * The word support always carries: one's canon is kept with one's father of
 * confession, so support people are invited only with his blessing; and those
 * who support someone see their canon to pray for them, not to take it on.
 * `side` is who is reading it.
 */
export default function CanonSupportNotice({ side, arabic }: { side: 'inviting' | 'supporting'; arabic: boolean }) {
  const title = side === 'inviting'
    ? tr(
      'Invite only with the permission of your father of confession',
      'N’invitez qu’avec la permission de votre père de confession',
      'لا تدعُ أحدًا إلا بإذن أب اعترافك',
    )
    : tr(
      'Keep what you see in prayer, and to yourself',
      'Gardez ce que vous voyez dans la prière, et pour vous',
      'احفظ ما تراه في صلاتك ولنفسك',
    );
  const body = side === 'inviting'
    ? tr(
      'A support person sees your canon and how you keep it each day, in their own app. Your canon is part of your spiritual life with your father of confession: ask him before you invite anyone, even close friends or a support group.',
      'Une personne de soutien voit votre canon et comment vous le gardez chaque jour, dans sa propre application. Votre canon fait partie de votre vie spirituelle avec votre père de confession : demandez-lui avant d’inviter qui que ce soit, même des amis proches ou un groupe de soutien.',
      'يرى الشخص الداعم قانونك وكيف تحافظ عليه كل يوم، في تطبيقه. قانونك جزء من حياتك الروحية مع أب اعترافك: استأذنه قبل أن تدعو أحدًا، حتى الأصدقاء المقرّبين أو مجموعة دعم.',
    )
    : tr(
      'A canon is given to each person by their own father of confession. You see this one to pray for them and encourage them; don’t take any of it on as your own without your father of confession’s blessing.',
      'Un canon est donné à chacun par son propre père de confession. Vous voyez celui-ci pour prier pour lui et l’encourager ; n’en adoptez rien sans la bénédiction de votre père de confession.',
      'يُعطى القانون لكل إنسان من أب اعترافه. ترى هذا القانون لتصلي لأجل صاحبه وتشجّعه؛ فلا تأخذ بشيء منه دون بركة أب اعترافك.',
    );
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Icon name="shield-checkmark-outline" size={22} color={COLORS.goldBright} />
      <View style={styles.text}>
        <Text style={[styles.title, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
        <Text style={[styles.body, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start', backgroundColor: COLORS.goldSoft, borderColor: COLORS.goldLine, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  text: { flex: 1, gap: 4, minWidth: 0 },
  title: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  body: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
