'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { tr } from '@/utils/appText';

const MAX_FONT_SCALE = 1.3;

/**
 * The word a shared canon always carries: one's canon is kept with one's
 * father of confession, so it is shared only with his blessing, and taken
 * on, from a friend, only after asking him. `side` is who is reading it.
 */
export default function CanonShareNotice({ side, arabic }: { side: 'sharing' | 'receiving'; arabic: boolean }) {
  const title = side === 'sharing'
    ? tr(
      'Share only with the permission of your father of confession',
      'Ne partagez qu’avec la permission de votre père de confession',
      'لا تشارك إلا بإذن أب اعترافك',
    )
    : tr(
      'Ask your father of confession before taking this on',
      'Demandez à votre père de confession avant de l’adopter',
      'استشر أب اعترافك قبل أن تأخذ بهذا',
    );
  const body = side === 'sharing'
    ? tr(
      'Your canon is part of your spiritual life with your father of confession. Ask him before you share any of it, even with close friends or a support group, and share only what he has blessed.',
      'Votre canon fait partie de votre vie spirituelle avec votre père de confession. Demandez-lui avant d’en partager quoi que ce soit, même avec des amis proches ou un groupe de soutien, et ne partagez que ce qu’il a béni.',
      'قانونك جزء من حياتك الروحية مع أب اعترافك. استأذنه قبل أن تشارك أي شيء منه، حتى مع أصدقاء مقرّبين أو مجموعة دعم، ولا تشارك إلا ما باركه.',
    )
    : tr(
      'A canon is given to each person by their own father of confession. This one was shared for encouragement; don’t add any of it to your own canon without his blessing.',
      'Un canon est donné à chacun par son propre père de confession. Celui-ci a été partagé pour encourager ; n’en ajoutez rien au vôtre sans sa bénédiction.',
      'يُعطى القانون لكل إنسان من أب اعترافه. شورك هذا للتشجيع؛ فلا تُضف شيئًا منه إلى قانونك دون بركته.',
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
