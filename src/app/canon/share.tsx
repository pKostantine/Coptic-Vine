'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { InlineSwitch, PrimaryButton } from '@/components/canon/CanonEditorParts';
import { CanonCheck } from '@/components/canon/CanonParts';
import CanonShareNotice from '@/components/canon/CanonShareNotice';
import { CANON_KIND_ICONS, canonItemSummary, canonItemTitle } from '@/components/canon/canonText';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, SectionHeading } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useSpiritualCanon } from '@/context/SpiritualCanonContext';
import { useCanonInstructions } from '@/hooks/useCanonInstructions';
import { canonShareUrl, createCanonShare, deleteMyCanonShare, listMyCanonShares, type CanonShare } from '@/services/spiritualCanonService';
import { tr } from '@/utils/appText';
import { formatDayMonthDate } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { shareLink } from '@/utils/shareLink';

const MAX_FONT_SCALE = 1.3;
const PLACEHOLDER = 'rgba(205, 216, 203, 0.55)';

function confirmStop(onConfirm: () => void) {
  const question = tr('Stop sharing this link?', 'Arrêter de partager ce lien ?', 'أتوقف مشاركة هذا الرابط؟');
  const detail = tr('Anyone who has it will no longer be able to open it.', 'Ceux qui l’ont ne pourront plus l’ouvrir.', 'لن يتمكن من لديه الرابط من فتحه بعد الآن.');
  if (Platform.OS === 'web') {
    if ((globalThis as { confirm?: (message: string) => boolean }).confirm?.(`${question}\n${detail}`)) onConfirm();
    return;
  }
  Alert.alert(question, detail, [
    { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
    { text: tr('Stop sharing', 'Arrêter', 'أوقف المشاركة'), style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Sharing parts of the spiritual canon with friends, a support group: the
 * father of confession's permission asked first, then the items chosen, a
 * name and a word to go with them, and a link to send. The links made before
 * are listed below, each to send again or stop.
 */
export default function CanonShareScreen() {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const { user } = useAuth();
  const canon = useSpiritualCanon();
  const instructions = useCanonInstructions();

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [withInstructions, setWithInstructions] = useState(false);
  const accountName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const [name, setName] = useState(accountName);
  const [message, setMessage] = useState('');
  const [blessed, setBlessed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shares, setShares] = useState<CanonShare[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setShares(await listMyCanonShares());
    } catch {
      setShares([]);
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    let live = true;
    listMyCanonShares()
      .then((found) => { if (live) setShares(found); })
      .catch(() => { if (live) setShares([]); });
    return () => { live = false; };
  }, [user]);

  const hasInstructions = instructions.text.trim().length > 0;
  const allChosen = canon.items.length > 0 && canon.items.every((item) => chosen.has(item.id));
  const toggle = (id: string) => setChosen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const send = async (share: CanonShare) => {
    await shareLink({
      title: tr('A spiritual canon', 'Un canon spirituel', 'قانون روحي'),
      text: share.message,
      url: canonShareUrl(share.id),
    });
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const share = await createCanonShare({
        items: canon.items.filter((item) => chosen.has(item.id)),
        name,
        message,
        instructions: withInstructions && hasInstructions ? instructions.text : null,
      });
      setChosen(new Set());
      setWithInstructions(false);
      setMessage('');
      setBlessed(false);
      void refresh();
      await send(share);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to share your canon.', 'Impossible de partager votre canon.', 'تعذّرت مشاركة قانونك.'));
    } finally {
      setBusy(false);
    }
  };

  const stop = (share: CanonShare) => confirmStop(() => {
    void deleteMyCanonShare(share.id)
      .then(refresh)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  });

  const title = tr('Share Your Canon', 'Partager votre canon', 'شارك قانونك');
  const canCreate = blessed && chosen.size > 0 && !busy && canon.loaded;

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head><title>{title}</title></Head>
      <SubPageHeader compact title={title} arabic={arabic} onBack={() => goBack(router, '/canon' as never)} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <CanonShareNotice side="sharing" arabic={arabic} />

          {!user ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/account' as never)} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
              <Icon name="person-circle-outline" size={22} color={COLORS.gold} />
              <Text style={[styles.accountText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr('Sign in to share parts of your canon with a link.', 'Connectez-vous pour partager une partie de votre canon par un lien.', 'سجّل الدخول لتشارك أجزاء من قانونك برابط.')}
              </Text>
              <Icon name="chevron-forward" size={16} color={COLORS.gold} />
            </Pressable>
          ) : (
            <>
              <View style={styles.sectionHead}>
                <SectionHeading size="page" title={tr('What to share', 'Que partager', 'ماذا تشارك')} arabic={arabic} />
                {canon.items.length ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => setChosen(allChosen ? new Set() : new Set(canon.items.map((item) => item.id)))}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Text style={[styles.link, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {allChosen ? tr('Choose none', 'Aucun', 'لا شيء') : tr('Choose all', 'Tout choisir', 'اختر الكل')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.rows}>
                {canon.items.length ? canon.items.map((item) => {
                  const on = chosen.has(item.id);
                  return (
                    <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(item.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                      <View style={styles.rowIcon}><Icon name={CANON_KIND_ICONS[item.kind]} size={18} color={COLORS.gold} /></View>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowTitle, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{canonItemTitle(item)}</Text>
                        <Text style={[styles.rowDetail, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>{canonItemSummary(item)}</Text>
                      </View>
                      <CanonCheck done={on} label={canonItemTitle(item)} onPress={() => toggle(item.id)} size={26} />
                    </Pressable>
                  );
                }) : (
                  <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {canon.loaded
                      ? tr('There is nothing in your canon to share yet.', 'Il n’y a encore rien à partager dans votre canon.', 'لا شيء في قانونك لتشاركه بعد.')
                      : tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}
                  </Text>
                )}
                {hasInstructions ? (
                  <View style={styles.card}>
                    <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                    <InlineSwitch
                      label={tr('Add your father of confession’s instructions', 'Ajouter les consignes de votre père de confession', 'أضف إرشادات أب اعترافك')}
                      detail={tr(
                        'These are usually the most personal. Add them only if he has said you may.',
                        'Elles sont souvent les plus personnelles. Ne les ajoutez que s’il vous l’a permis.',
                        'هي عادةً الأكثر خصوصية. لا تضفها إلا إذا أذن لك بذلك.',
                      )}
                      on={withInstructions}
                      onPress={() => setWithInstructions((value) => !value)}
                      arabic={arabic}
                    />
                  </View>
                ) : null}
                <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {tr(
                    'Your ticks and reminders are never shared, and what you change later isn’t either: the link holds a copy of what you chose now.',
                    'Vos coches et rappels ne sont jamais partagés, ni ce que vous changerez ensuite : le lien garde une copie de ce que vous choisissez maintenant.',
                    'لا تُشارَك علاماتك ولا تذكيراتك أبدًا، ولا ما تغيّره لاحقًا: يحمل الرابط نسخة مما تختاره الآن.',
                  )}
                </Text>
              </View>

              <SectionHeading size="page" title={tr('With it', 'Avec lui', 'معه')} arabic={arabic} />
              <View style={styles.fields}>
                <Text style={[styles.label, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Your name, as your friends will see it (optional)', 'Votre nom, tel que vos amis le verront (facultatif)', 'اسمك كما سيراه أصدقاؤك (اختياري)')}</Text>
                <TextInput value={name} onChangeText={setName} maxLength={80} placeholder={tr('Your name', 'Votre nom', 'اسمك')} placeholderTextColor={PLACEHOLDER} style={[styles.input, arabic && styles.arabic]} />
                <Text style={[styles.label, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('A word to go with it (optional)', 'Un mot pour l’accompagner (facultatif)', 'كلمة ترافقه (اختيارية)')}</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  maxLength={1000}
                  multiline
                  textAlignVertical="top"
                  placeholder={tr('For our group, to keep each other in prayer…', 'Pour notre groupe, pour prier les uns pour les autres…', 'لمجموعتنا، لنصلي بعضنا لأجل بعض…')}
                  placeholderTextColor={PLACEHOLDER}
                  style={[styles.input, styles.multiline, arabic && styles.arabic]}
                />
              </View>

              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: blessed }} onPress={() => setBlessed((value) => !value)} style={({ pressed }) => [styles.blessing, pressed && styles.pressed]}>
                <CanonCheck done={blessed} label={tr('My father of confession has given me his permission to share this', 'Mon père de confession m’a permis de partager ceci', 'أذن لي أب اعترافي بمشاركة هذا')} onPress={() => setBlessed((value) => !value)} size={26} />
                <Text style={[styles.blessingText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {tr('My father of confession has given me his permission to share this.', 'Mon père de confession m’a permis de partager ceci.', 'أذن لي أب اعترافي بمشاركة هذا.')}
                </Text>
              </Pressable>

              {error ? <Text style={[styles.error, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{error}</Text> : null}
              <PrimaryButton
                label={busy ? tr('Making the link…', 'Création du lien…', 'جارٍ إنشاء الرابط…') : tr('Share a link', 'Partager un lien', 'شارك رابطًا')}
                onPress={() => void create()}
                disabled={!canCreate}
                arabic={arabic}
              />

              {shares?.length ? (
                <>
                  <SectionHeading size="page" title={tr('Your shared links', 'Vos liens partagés', 'روابطك المشتركة')} arabic={arabic} />
                  <View style={styles.rows}>
                    {shares.map((share) => (
                      <View key={share.id} style={styles.shareRow}>
                        <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {share.items.map(canonItemTitle).join(', ')}
                          </Text>
                          <Text style={[styles.rowDetail, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {[
                              formatDayMonthDate(new Date(share.createdAt), arabic),
                              share.instructions ? tr('with the instructions', 'avec les consignes', 'مع الإرشادات') : null,
                              share.message,
                            ].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={tr('Send again', 'Renvoyer', 'أرسل مجددًا')} hitSlop={6} onPress={() => void send(share)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                          <Icon name="share-outline" size={18} color={COLORS.gold} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={tr('Stop sharing', 'Arrêter de partager', 'أوقف المشاركة')} hitSlop={6} onPress={() => stop(share)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
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
  sectionHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700', paddingBottom: 14 },
  rows: { gap: 6 },
  row: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 60, overflow: 'hidden', paddingLeft: 14, paddingRight: 14, paddingVertical: 10 },
  shareRow: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 8, minHeight: 60, overflow: 'hidden', paddingLeft: 14, paddingRight: 8, paddingVertical: 10 },
  rowIcon: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', lineHeight: 20 },
  rowDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  iconButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  card: { borderRadius: 16, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 6 },
  fields: { gap: 8 },
  label: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  input: { backgroundColor: 'rgba(0, 0, 0, 0.38)', borderRadius: 14, color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 88 },
  blessing: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 8, paddingHorizontal: 14, paddingVertical: 14 },
  blessingText: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, fontWeight: '600', lineHeight: 20 },
  error: { color: '#F0A49A', fontFamily: TYPOGRAPHY.body, fontSize: 13.5, paddingHorizontal: 4 },
  quiet: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingHorizontal: 4, paddingTop: 4 },
  account: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  accountText: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
