'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/canon/CanonEditorParts';
import CanonSupportNotice from '@/components/canon/CanonSupportNotice';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { acceptCanonSupportInvite, loadCanonSupportInvite, type CanonSupportInviteView } from '@/services/spiritualCanonService';
import { tr } from '@/utils/appText';
import { goBack } from '@/utils/navigation';

const MAX_FONT_SCALE = 1.3;

/**
 * An invite to be someone's support person, opened from their link: who asks
 * and what they wrote, what a support person sees, and the way to accept it
 * (signed in). Accepted, their canon opens; it is found again afterwards on
 * one's own canon page, under People You Support.
 */
export default function CanonInviteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const linkId = id ? String(id) : '';
  // What was read, for which link and as whom: signing in reads it again (it may be one's own, or already accepted).
  const [read, setRead] = useState<{ key: string; invite: CanonSupportInviteView | null; failed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${linkId}:${userId ?? ''}`;
  const current = read?.key === key ? read : null;
  const invite = current?.invite ?? null;
  const failed = !linkId || Boolean(current?.failed);

  useEffect(() => {
    if (!linkId) return;
    let live = true;
    loadCanonSupportInvite(linkId)
      .then((found) => { if (live) setRead({ key, invite: found, failed: false }); })
      .catch(() => { if (live) setRead({ key, invite: null, failed: true }); });
    return () => { live = false; };
  }, [key, linkId]);

  const openCanon = (supportId: string) => router.replace(`/canon/supporting/${encodeURIComponent(supportId)}` as never);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const person = await acceptCanonSupportInvite(linkId);
      openCanon(person.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to accept the invite.', 'Impossible d’accepter l’invitation.', 'تعذّر قبول الدعوة.'));
    } finally {
      setBusy(false);
    }
  };

  const name = invite?.sharerName ?? null;
  const heading = name
    ? tr(`${name} invites you to be their support person`, `${name} vous invite à être sa personne de soutien`, `يدعوك ${name} لتكون الشخص الداعم له`)
    : tr('You are invited to be a support person', 'Vous êtes invité à être une personne de soutien', 'أنت مدعو لتكون شخصًا داعمًا');
  const title = tr('An Invitation', 'Une invitation', 'دعوة');

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <SubPageHeader compact title={title} arabic={arabic} onBack={() => goBack(router, '/canon' as never)} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          {failed ? (
            <View style={styles.note}>
              <Icon name="eye-outline" size={20} color={COLORS.muted} />
              <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr('This invite link was turned off.', 'Ce lien d’invitation a été désactivé.', 'تم إيقاف رابط الدعوة هذا.')}
              </Text>
            </View>
          ) : !invite ? (
            <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
          ) : (
            <>
              <View style={styles.hero}>
                <LinearGradient colors={['#173A1F', COLORS.greenDeep]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <Text style={[styles.kicker, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Spiritual canon', 'Canon spirituel', 'القانون الروحي')}</Text>
                <Text style={[styles.heroTitle, arabic && styles.arabicCentered]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>{heading}</Text>
                <Text style={[styles.heroText, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {invite.withInstructions
                    ? tr(
                      'You would see their spiritual canon, how they keep it each day and their father of confession’s instructions, in your own app, to keep them in prayer and encourage them.',
                      'Vous verriez leur canon spirituel, comment ils le gardent chaque jour et les consignes de leur père de confession, dans votre propre application, pour prier pour eux et les encourager.',
                      'سترى قانونه الروحي وكيف يحافظ عليه كل يوم وإرشادات أب اعترافه، في تطبيقك، لتذكره في صلاتك وتشجّعه.',
                    )
                    : tr(
                      'You would see their spiritual canon and how they keep it each day, in your own app, to keep them in prayer and encourage them.',
                      'Vous verriez leur canon spirituel et comment ils le gardent chaque jour, dans votre propre application, pour prier pour eux et les encourager.',
                      'سترى قانونه الروحي وكيف يحافظ عليه كل يوم، في تطبيقك، لتذكره في صلاتك وتشجّعه.',
                    )}
                </Text>
                {invite.message ? (
                  <Text style={[styles.message, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {arabic ? `«${invite.message}»` : `“${invite.message}”`}
                  </Text>
                ) : null}
              </View>

              <CanonSupportNotice side="supporting" arabic={arabic} />

              {error ? <Text style={[styles.error, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{error}</Text> : null}
              {invite.own ? (
                <>
                  <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tr('This is your own invite link. Send it to those you would like to support you.', 'C’est votre propre lien d’invitation. Envoyez-le à ceux dont vous aimeriez le soutien.', 'هذا رابط دعوتك. أرسله إلى من تودّ أن يدعموك.')}
                  </Text>
                  <PrimaryButton label={tr('Your Support People', 'Vos personnes de soutien', 'الداعمون لك')} onPress={() => router.replace('/canon/supporters' as never)} arabic={arabic} />
                </>
              ) : invite.supporting ? (
                <>
                  <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tr('You are already their support person.', 'Vous êtes déjà sa personne de soutien.', 'أنت بالفعل الشخص الداعم له.')}
                  </Text>
                  <PrimaryButton label={tr('Open Their Canon', 'Ouvrir son canon', 'افتح قانونه')} onPress={() => openCanon(invite.supporting!)} arabic={arabic} />
                </>
              ) : !user ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/account' as never)} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
                  <Icon name="person-circle-outline" size={22} color={COLORS.gold} />
                  <Text style={[styles.accountText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tr('Sign in to accept, then come back to this link.', 'Connectez-vous pour accepter, puis revenez à ce lien.', 'سجّل الدخول لتقبل، ثم عُد إلى هذا الرابط.')}
                  </Text>
                  <Icon name="chevron-forward" size={16} color={COLORS.gold} />
                </Pressable>
              ) : (
                <PrimaryButton
                  label={busy ? tr('Accepting…', 'Acceptation…', 'جارٍ القبول…') : tr('Become Their Support Person', 'Devenir sa personne de soutien', 'كن الشخص الداعم له')}
                  onPress={() => void accept()}
                  disabled={busy}
                  arabic={arabic}
                />
              )}
            </>
          )}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', gap: 14, maxWidth: 640, width: '100%' },
  pressed: { opacity: 0.75 },
  hero: { alignItems: 'center', borderRadius: 22, gap: 10, overflow: 'hidden', paddingBottom: 22, paddingHorizontal: 22, paddingTop: 24 },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 1.7, textTransform: 'uppercase' },
  heroTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 23, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
  heroText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  message: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 16, fontStyle: 'italic', lineHeight: 24, marginTop: 4, textAlign: 'center' },
  note: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  noteText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14.5 },
  quiet: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, paddingHorizontal: 4 },
  error: { color: '#F0A49A', fontFamily: TYPOGRAPHY.body, fontSize: 13.5, paddingHorizontal: 4 },
  account: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  accountText: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
