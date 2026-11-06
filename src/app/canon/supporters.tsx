'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { InlineSwitch, PrimaryButton } from '@/components/canon/CanonEditorParts';
import CanonSupportNotice from '@/components/canon/CanonSupportNotice';
import { confirmCanonAction } from '@/components/canon/confirmCanonAction';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, SectionHeading } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useCanonInstructions } from '@/hooks/useCanonInstructions';
import {
  canonInviteUrl,
  createCanonSupportInvite,
  deleteMyCanonSupportInvite,
  listMyCanonSupporters,
  listMyCanonSupportInvites,
  removeMyCanonSupporter,
  type CanonSupportInvite,
  type CanonSupportPerson,
} from '@/services/spiritualCanonService';
import { tr } from '@/utils/appText';
import { formatDayMonthDate } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { shareLink } from '@/utils/shareLink';

const MAX_FONT_SCALE = 1.3;
const PLACEHOLDER = 'rgba(205, 216, 203, 0.55)';

/**
 * The believer's support people: those who see their canon and how they keep
 * it, in their own app. The father of confession's permission is asked
 * first; then who supports them now, each to remove, an invite link to send
 * (anyone who has it may accept it until it is turned off), and the links
 * made before, each to send again or turn off.
 */
export default function CanonSupportersScreen() {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const { user } = useAuth();
  const instructions = useCanonInstructions();

  const accountName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  // The account's name until it is changed here; the session may arrive after the page first renders.
  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? accountName;
  const [message, setMessage] = useState('');
  const [withInstructions, setWithInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supporters, setSupporters] = useState<CanonSupportPerson[] | null>(null);
  const [invites, setInvites] = useState<CanonSupportInvite[]>([]);

  const refresh = useCallback(async () => {
    const [people, links] = await Promise.all([
      listMyCanonSupporters().catch(() => []),
      listMyCanonSupportInvites().catch(() => []),
    ]);
    setSupporters(people);
    setInvites(links);
  }, []);
  // Read again whenever the page is opened: someone may have accepted since.
  const signedIn = Boolean(user);
  useFocusEffect(useCallback(() => {
    if (signedIn) void refresh();
  }, [refresh, signedIn]));

  const hasInstructions = instructions.text.trim().length > 0;

  const send = async (invite: CanonSupportInvite) => {
    await shareLink({
      title: tr('Be my support person', 'Soyez ma personne de soutien', 'كن الشخص الداعم لي'),
      text: invite.message,
      url: canonInviteUrl(invite.id),
    });
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const invite = await createCanonSupportInvite({ name, message, withInstructions: withInstructions && hasInstructions });
      setMessage('');
      setWithInstructions(false);
      void refresh();
      await send(invite);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to make the invite link.', 'Impossible de créer le lien d’invitation.', 'تعذّر إنشاء رابط الدعوة.'));
    } finally {
      setBusy(false);
    }
  };

  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));

  const turnOff = (invite: CanonSupportInvite) => confirmCanonAction({
    question: tr('Turn off this link?', 'Désactiver ce lien ?', 'أتوقف هذا الرابط؟'),
    detail: tr(
      'No one else will be able to accept it. Those who already did stay your support people.',
      'Personne d’autre ne pourra l’accepter. Ceux qui l’ont déjà accepté restent vos personnes de soutien.',
      'لن يتمكن أحد آخر من قبوله. ومن قبله يبقى من الداعمين لك.',
    ),
    action: tr('Turn off', 'Désactiver', 'أوقفه'),
  }, () => {
    void deleteMyCanonSupportInvite(invite.id).then(refresh).catch(fail);
  });

  const remove = (person: CanonSupportPerson) => confirmCanonAction({
    question: tr('Remove this support person?', 'Retirer cette personne de soutien ?', 'أتزيل هذا الشخص الداعم؟'),
    detail: tr(
      `${person.name || 'They'} will no longer see your canon.`,
      `${person.name || 'Cette personne'} ne verra plus votre canon.`,
      `لن يرى ${person.name || 'هذا الشخص'} قانونك بعد الآن.`,
    ),
    action: tr('Remove', 'Retirer', 'أزِل'),
  }, () => {
    void removeMyCanonSupporter(person.id).then(refresh).catch(fail);
  });

  const title = tr('Support People', 'Personnes de soutien', 'الأشخاص الداعمون');

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head><title>{title}</title></Head>
      <SubPageHeader compact title={title} arabic={arabic} onBack={() => goBack(router, '/canon' as never)} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <CanonSupportNotice side="inviting" arabic={arabic} />

          {!user ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/account' as never)} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
              <Icon name="person-circle-outline" size={22} color={COLORS.gold} />
              <Text style={[styles.accountText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr('Sign in to invite support people.', 'Connectez-vous pour inviter des personnes de soutien.', 'سجّل الدخول لتدعو أشخاصًا داعمين.')}
              </Text>
              <Icon name="chevron-forward" size={16} color={COLORS.gold} />
            </Pressable>
          ) : (
            <>
              <SectionHeading size="page" title={tr('Your Support People', 'Vos personnes de soutien', 'الداعمون لك')} arabic={arabic} />
              <View style={styles.rows}>
                {supporters?.length ? supporters.map((person) => (
                  <View key={person.id} style={styles.row}>
                    <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                    {/* Its own View: beside the absolute gradient, a bare icon paints under it on the web. */}
                    <View><Icon name="person-circle-outline" size={22} color={COLORS.gold} /></View>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {person.name || tr('A support person', 'Une personne de soutien', 'شخص داعم')}
                      </Text>
                      <Text style={[styles.rowDetail, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {[
                          `${tr('Since', 'Depuis le', 'منذ')} ${formatDayMonthDate(new Date(person.since), arabic)}`,
                          person.withInstructions ? tr('sees the instructions', 'voit les consignes', 'يرى الإرشادات') : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${tr('Remove', 'Retirer', 'أزِل')}: ${person.name}`}
                      hitSlop={6}
                      onPress={() => remove(person)}
                      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                    >
                      <Icon name="trash-outline" size={18} color={COLORS.muted} />
                    </Pressable>
                  </View>
                )) : (
                  <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {supporters
                      ? tr(
                        'No one yet. Invite those who keep you in prayer: once they accept, they see your canon and how you keep it.',
                        'Personne pour l’instant. Invitez ceux qui prient pour vous : une fois l’invitation acceptée, ils voient votre canon et comment vous le gardez.',
                        'لا أحد بعد. ادعُ من يذكرونك في صلواتهم: متى قبلوا الدعوة رأوا قانونك وكيف تحافظ عليه.',
                      )
                      : tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}
                  </Text>
                )}
              </View>

              <SectionHeading size="page" title={tr('Invite', 'Inviter', 'ادعُ')} arabic={arabic} />
              <View style={styles.fields}>
                <Text style={[styles.label, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Your name, as they will see it', 'Votre nom, tel qu’ils le verront', 'اسمك كما سيرونه')}</Text>
                <TextInput value={name} onChangeText={setName} maxLength={80} placeholder={tr('Your name', 'Votre nom', 'اسمك')} placeholderTextColor={PLACEHOLDER} style={[styles.input, arabic && styles.arabic]} />
                <Text style={[styles.label, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('A word to go with it (optional)', 'Un mot pour l’accompagner (facultatif)', 'كلمة ترافقه (اختيارية)')}</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  maxLength={1000}
                  multiline
                  textAlignVertical="top"
                  placeholder={tr('Will you keep me in prayer and help me keep my canon?', 'Voulez-vous prier pour moi et m’aider à garder mon canon ?', 'هل تذكرني في صلاتك وتساعدني على حفظ قانوني؟')}
                  placeholderTextColor={PLACEHOLDER}
                  style={[styles.input, styles.multiline, arabic && styles.arabic]}
                />
              </View>
              {hasInstructions ? (
                <View style={styles.card}>
                  <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <InlineSwitch
                    label={tr('Let them read your father of confession’s instructions', 'Leur laisser lire les consignes de votre père de confession', 'اسمح لهم بقراءة إرشادات أب اعترافك')}
                    detail={tr(
                      'These are usually the most personal. Include them only if he has said you may.',
                      'Elles sont souvent les plus personnelles. Ne les incluez que s’il vous l’a permis.',
                      'هي عادةً الأكثر خصوصية. لا تضمّنها إلا إذا أذن لك بذلك.',
                    )}
                    on={withInstructions}
                    onPress={() => setWithInstructions((value) => !value)}
                    arabic={arabic}
                  />
                </View>
              ) : null}
              {error ? <Text style={[styles.error, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{error}</Text> : null}
              <PrimaryButton
                label={busy ? tr('Making the link…', 'Création du lien…', 'جارٍ إنشاء الرابط…') : tr('Send an Invite Link', 'Envoyer un lien d’invitation', 'أرسل رابط دعوة')}
                onPress={() => void create()}
                disabled={busy}
                arabic={arabic}
              />
              <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr(
                  'Anyone you send it to can accept it, until you turn it off.',
                  'Toute personne à qui vous l’envoyez peut l’accepter, jusqu’à ce que vous le désactiviez.',
                  'يستطيع كل من ترسله إليه أن يقبله، إلى أن توقفه.',
                )}
              </Text>

              {invites.length ? (
                <>
                  <SectionHeading size="page" title={tr('Your Invite Links', 'Vos liens d’invitation', 'روابط دعوتك')} arabic={arabic} />
                  <View style={styles.rows}>
                    {invites.map((invite) => (
                      <View key={invite.id} style={styles.row}>
                        <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {invite.message || tr('Invite link', 'Lien d’invitation', 'رابط دعوة')}
                          </Text>
                          <Text style={[styles.rowDetail, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {[
                              formatDayMonthDate(new Date(invite.createdAt), arabic),
                              invite.withInstructions ? tr('with the instructions', 'avec les consignes', 'مع الإرشادات') : null,
                            ].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={tr('Send again', 'Renvoyer', 'أرسل مجددًا')} hitSlop={6} onPress={() => void send(invite)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                          <Icon name="share-outline" size={18} color={COLORS.gold} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={tr('Turn off', 'Désactiver', 'أوقفه')} hitSlop={6} onPress={() => turnOff(invite)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                          <Icon name="trash-outline" size={18} color={COLORS.muted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', gap: 12, maxWidth: 640, width: '100%' },
  pressed: { opacity: 0.75 },
  rows: { gap: 8 },
  row: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 60, overflow: 'hidden', paddingLeft: 14, paddingRight: 8, paddingVertical: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', lineHeight: 20 },
  rowDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  iconButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  card: { borderRadius: 16, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 6 },
  fields: { gap: 8 },
  label: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  input: { backgroundColor: 'rgba(0, 0, 0, 0.38)', borderRadius: 14, color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 88 },
  error: { color: '#F0A49A', fontFamily: TYPOGRAPHY.body, fontSize: 13.5, paddingHorizontal: 4 },
  quiet: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingHorizontal: 4, paddingTop: 2 },
  account: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  accountText: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
