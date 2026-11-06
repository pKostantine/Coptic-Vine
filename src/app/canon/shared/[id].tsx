'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import CanonShareNotice from '@/components/canon/CanonShareNotice';
import { CANON_KIND_ICONS, canonItemSummary, canonItemTitle } from '@/components/canon/canonText';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, SectionHeading } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useSpiritualCanon } from '@/context/SpiritualCanonContext';
import { adoptedCanonItem, loadCanonShare, type CanonShare } from '@/services/spiritualCanonService';
import { tr } from '@/utils/appText';
import { goBack } from '@/utils/navigation';
import { MAX_CANON_ITEMS, type CanonItem } from '@/utils/spiritualCanon';

const MAX_FONT_SCALE = 1.3;

/**
 * A canon a friend shared, opened from their link: what it holds, to read
 * for encouragement and (with one's own father of confession's blessing, as
 * the page says first) to take into one's own canon, an item at a time or
 * all together. Opens signed out too.
 */
export default function SharedCanonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const canon = useSpiritualCanon();
  // What was read, and for which link: another link opened here starts again from Loading.
  const [read, setRead] = useState<{ id: string; share: CanonShare | null; failed: boolean } | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const linkId = id ? String(id) : '';
  const current = read?.id === linkId ? read : null;
  const share = current?.share ?? null;
  const failed = !linkId || Boolean(current?.failed);

  useEffect(() => {
    if (!linkId) return;
    let live = true;
    loadCanonShare(linkId)
      .then((found) => { if (live) setRead({ id: linkId, share: found, failed: false }); })
      .catch(() => { if (live) setRead({ id: linkId, share: null, failed: true }); });
    return () => { live = false; };
  }, [linkId]);

  const room = MAX_CANON_ITEMS - canon.items.length;
  const addable = (share?.items ?? []).filter((item) => !added.has(item.id));
  const add = (items: CanonItem[]) => {
    const taken = items.slice(0, Math.max(0, room));
    for (const item of taken) canon.saveItem(adoptedCanonItem(item));
    setAdded((current) => new Set([...current, ...taken.map((item) => item.id)]));
  };

  const title = share?.sharerName
    ? tr(`${share.sharerName}’s canon`, `Le canon de ${share.sharerName}`, `قانون ${share.sharerName}`)
    : tr('A Shared Canon', 'Un canon partagé', 'قانون مُشارَك');

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head>
        <title>{tr('A Shared Canon', 'Un canon partagé', 'قانون مُشارَك')}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <SubPageHeader compact title={title} arabic={arabic} onBack={() => goBack(router, '/canon' as never)} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <CanonShareNotice side="receiving" arabic={arabic} />

          {failed ? (
            <View style={styles.note}>
              <Icon name="eye-outline" size={20} color={COLORS.muted} />
              <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr(
                  'This canon is no longer shared, or the link isn’t complete.',
                  'Ce canon n’est plus partagé, ou le lien est incomplet.',
                  'لم يعد هذا القانون مُشارَكًا، أو الرابط غير مكتمل.',
                )}
              </Text>
            </View>
          ) : !share ? (
            <Text style={[styles.quiet, arabic && styles.arabic]}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
          ) : (
            <>
              {share.message ? (
                <View style={styles.message}>
                  <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <Text style={[styles.messageText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{share.message}</Text>
                  {share.sharerName ? <Text style={[styles.byline, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr(`Shared by ${share.sharerName}`, `Partagé par ${share.sharerName}`, `شاركه ${share.sharerName}`)}</Text> : null}
                </View>
              ) : null}

              {share.instructions ? (
                <View style={styles.message}>
                  <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <Text style={[styles.kicker, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tr('From their father of confession', 'De leur père de confession', 'من أب اعترافه')}
                  </Text>
                  <Text style={[styles.messageText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{share.instructions}</Text>
                </View>
              ) : null}

              <View style={styles.sectionHead}>
                <SectionHeading size="page" title={tr('In this canon', 'Dans ce canon', 'في هذا القانون')} arabic={arabic} />
                {canon.loaded && addable.length > 1 && room >= addable.length ? (
                  <Pressable accessibilityRole="button" hitSlop={6} onPress={() => add(addable)} style={({ pressed }) => pressed && styles.pressed}>
                    <Text style={[styles.link, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Add all to mine', 'Tout ajouter au mien', 'أضف الكل إلى قانوني')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.rows}>
                {share.items.map((item) => {
                  const isAdded = added.has(item.id);
                  const label = `${tr('Add to my canon', 'Ajouter à mon canon', 'أضف إلى قانوني')}: ${canonItemTitle(item)}`;
                  return (
                    <View key={item.id} style={styles.row}>
                      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                      <View style={styles.rowIcon}><Icon name={CANON_KIND_ICONS[item.kind]} size={18} color={COLORS.gold} /></View>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowTitle, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{canonItemTitle(item)}</Text>
                        <Text style={[styles.rowDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{canonItemSummary(item)}</Text>
                        {item.kind === 'custom' && item.note ? <Text style={[styles.rowDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.note}</Text> : null}
                      </View>
                      {isAdded ? (
                        <View style={styles.addedBadge} accessibilityLabel={tr('Added', 'Ajouté', 'أُضيف')}>
                          <Icon name="checkmark" size={17} color={COLORS.gold} />
                        </View>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={label}
                          accessibilityState={{ disabled: !canon.loaded || room <= 0 }}
                          disabled={!canon.loaded || room <= 0}
                          hitSlop={6}
                          onPress={() => add([item])}
                          style={({ pressed }) => [styles.addBadge, (!canon.loaded || room <= 0) && styles.disabled, pressed && styles.pressed]}
                        >
                          <Icon name="add" size={18} color={COLORS.greenDeep} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
              {room <= 0 && addable.length ? (
                <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {tr('Your canon is full. Remove something to add more.', 'Votre canon est plein. Retirez un élément pour en ajouter.', 'قانونك ممتلئ. احذف شيئًا لتضيف غيره.')}
                </Text>
              ) : null}
              {added.size ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/canon' as never)} style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
                  <Text style={[styles.openText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Open my canon', 'Ouvrir mon canon', 'افتح قانوني')}</Text>
                  <Icon name="chevron-forward" size={16} color={COLORS.gold} />
                </Pressable>
              ) : null}
              <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr(
                  'What you add becomes your own: change it, set your own reminders, or remove it whenever you like.',
                  'Ce que vous ajoutez devient le vôtre : modifiez-le, réglez vos rappels ou retirez-le quand vous voulez.',
                  'ما تضيفه يصير لك: عدّله أو اضبط تذكيراتك أو احذفه متى شئت.',
                )}
              </Text>
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
  disabled: { opacity: 0.45 },
  note: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  noteText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14.5 },
  message: { borderRadius: 16, gap: 6, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 14 },
  messageText: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 16, lineHeight: 24 },
  byline: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5 },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  sectionHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700', paddingBottom: 14 },
  rows: { gap: 6 },
  row: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 60, overflow: 'hidden', paddingLeft: 14, paddingRight: 12, paddingVertical: 10 },
  rowIcon: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', lineHeight: 20 },
  rowDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 17 },
  addBadge: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  addedBadge: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 15, borderWidth: 1, height: 30, justifyContent: 'center', width: 30 },
  open: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 4, paddingHorizontal: 4, paddingVertical: 4 },
  openText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  quiet: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingHorizontal: 4, paddingTop: 4 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
