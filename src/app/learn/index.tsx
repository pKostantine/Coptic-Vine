'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import LearningSeasonTile from '@/components/learning/LearningSeasonTile';
import LearningSectionNav from '@/components/learning/LearningSectionNav';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import PersonMedallion from '@/components/vine/ui/PersonMedallion';
import TabHeader from '@/components/vine/ui/TabHeader';
import { useLiturgicalDay } from '@/components/vine/ui/useLiturgicalDay';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { learningService } from '@/services/learningService';
import type { LearningHomePayload, LearningItemLibraryPayload } from '@/types/learningPlatform';
import { learningSeasonLook } from '@/utils/learningSeasonLook';
import { useSidePadding } from '@/utils/useSidePadding';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

/** How many season tiles sit side by side: two on a phone, four on the iPad and desktop (three on a narrow iPad). */
function tileColumnsFor(width: number, wide: boolean): number {
  if (!wide) return 2;
  return width >= 900 ? 4 : 3;
}

/**
 * Learn & Study's Discover page (Coptic Vine design, "Learn"): the cantors as
 * medallions, then the seasons as tiles in their own colours, the Church's
 * present season marked "Now"; and, for someone part-way through, what they
 * were learning. The iPad and desktop set the cantors in a row of larger
 * medallions and the seasons four across.
 */
export default function LearningHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const width = useContentWidth();
  const { user } = useAuth();
  const { preferences } = useReadingPreferences();
  const day = useLiturgicalDay();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const wide = layout !== 'phone';
  const [home, setHome] = useState<LearningHomePayload | null>(null);
  const [library, setLibrary] = useState<LearningItemLibraryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the load below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([learningService.getHome(locale), learningService.getItemLibrary(locale)])
      .then(([homePayload, libraryPayload]) => {
        if (!active) return;
        setError(null);
        setHome(homePayload);
        setLibrary(libraryPayload);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load Learn & Study.');
      });
    return () => { active = false; };
  }, [locale, user?.id, attempt]);

  const continueLearning = library?.items.filter((item) => item.state === 'learning').slice(0, 4) ?? [];
  const gutter = wide ? 0 : 16;
  const available = width - (wide ? 72 : 32);
  const columns = tileColumnsFor(available, wide);
  const tileGap = wide ? 16 : 10;
  const tileWidth = Math.floor((available - tileGap * (columns - 1)) / columns);
  // The season the Church is in wears the "Now" badge: the first tile in the day's colours.
  const seasons = (home?.seasons ?? []).map((season) => ({ season, look: learningSeasonLook(season) }));
  const nowId = seasons.find(({ look }) => look.theme === day.theme.key)?.season.id ?? null;

  const browseAll = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Icon name="chevron-forward" size={18} color={COLORS.gold} />
    </Pressable>
  );

  // The page runs to both edges; its content keeps clear of the notch.
  const sidePadding = useSidePadding(wide ? 36 : 0);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head>
        <title>{tr('Learn & Study — Coptic Vine', 'Apprendre — Coptic Vine', 'تعلّم وادرس — كوبتك فاين')}</title>
      </Head>

      <NowPlayingAwareScrollView
        // Keyed by layout: a turn of the phone mounts the page afresh rather than
        // restyling its views in place, which iOS laid out wrongly (a column of zero width).
        key={layout}
        contentContainerStyle={[styles.content, wide && [styles.contentWide, { paddingTop: insets.top + 28 }], sidePadding]}
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind="green" tall={wide} />
        <PageGutterProvider gutter={gutter}>
          <TabHeader title={tr('Learn & Study', 'Apprendre', 'تعلّم وادرس')} arabic={arabic} wide={wide} nav={<LearningSectionNav active="home" flush={wide} />} />

          {!home && !error ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
          {error ? (
            <LoadFailure
              error={error}
              layout="inline"
              onRetry={() => {
                setError(null);
                setAttempt((count) => count + 1);
              }}
            />
          ) : null}

          {home ? (
            <>
              <SectionHeading size="page"
                title={tr('By Cantor', 'Par chantre', 'حسب المعلّم')}
                arabic={arabic}
                trailing={browseAll(tr('All cantors', 'Tous les chantres', 'كل المعلّمين'), () => router.push('/learn/cantors'))}
              />
              {home.cantors.length ? (
                wide ? (
                  <View style={styles.peopleWide}>
                    {home.cantors.map((cantor) => (
                      <PersonMedallion
                        key={cantor.id}
                        name={cantor.displayName}
                        imageUri={learningService.resolveAsset(cantor.profileImageAsset)}
                        size={140}
                        arabic={arabic}
                        onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: cantor.id } })}
                      />
                    ))}
                  </View>
                ) : (
                  <NowPlayingAwareScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.people, { paddingHorizontal: gutter }]}>
                    {home.cantors.map((cantor) => (
                      <PersonMedallion
                        key={cantor.id}
                        name={cantor.displayName}
                        imageUri={learningService.resolveAsset(cantor.profileImageAsset)}
                        size={92}
                        arabic={arabic}
                        onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: cantor.id } })}
                      />
                    ))}
                  </NowPlayingAwareScrollView>
                )
              ) : (
                <Text style={[styles.empty, { marginHorizontal: gutter }, arabic && styles.arabic]}>{tr('No cantors yet.', 'Aucun chantre pour l’instant.', 'لا يوجد معلّمون بعد.')}</Text>
              )}

              <SectionHeading size="page"
                title={tr('By Season', 'Par temps liturgique', 'حسب الموسم')}
                arabic={arabic}
                trailing={browseAll(tr('All seasons', 'Tous les temps', 'كل المواسم'), () => router.push('/learn/seasons'))}
              />
              <View style={[styles.tiles, { gap: tileGap, paddingHorizontal: gutter }]}>
                {seasons.map(({ season, look }) => (
                  <View key={season.id} style={{ width: tileWidth }}>
                    <LearningSeasonTile
                      title={season.title}
                      look={look}
                      now={season.id === nowId}
                      nowLabel={tr('Now', 'Maintenant', 'الآن')}
                      arabic={arabic}
                      large={wide}
                      onPress={() => router.push({ pathname: '/learn/season/[id]', params: { id: season.id } })}
                    />
                  </View>
                ))}
              </View>

              {continueLearning.length ? (
                <>
                  <SectionHeading size="page"
                    title={tr('Continue Learning', 'Continuer l’apprentissage', 'أكمل التعلّم')}
                    arabic={arabic}
                    trailing={browseAll(tr('Open My Learning', 'Ouvrir Mon apprentissage', 'افتح تعلّمي'), () => router.push('/learn/library'))}
                  />
                  <View style={[styles.continueList, { paddingHorizontal: gutter }]}>
                    {continueLearning.map((item, index) => (
                      <Pressable
                        accessibilityRole="button"
                        key={item.itemKind + ':' + item.itemId}
                        style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
                        onPress={() => item.itemKind === 'lesson'
                          ? router.push({ pathname: '/learn/lesson/[id]', params: { id: item.itemId, setId: item.containerId } })
                          : router.push({ pathname: '/learn/album/[id]', params: { id: item.containerId } })}
                      >
                        <View style={styles.continueNumber}><Text style={styles.continueNumberText}>{index + 1}</Text></View>
                        <View style={styles.continueInfo}>
                          <Text numberOfLines={1} style={[styles.continueTitle, arabic && styles.arabic]}>{item.title}</Text>
                          <Text numberOfLines={1} style={[styles.continueMeta, arabic && styles.arabic]}>
                            {item.subtitle || item.cantorName}
                          </Text>
                        </View>
                        <View style={styles.resume}><Icon name="play" size={14} color={COLORS.greenDeep} /></View>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </PageGutterProvider>
      </NowPlayingAwareScrollView>

      <BottomTabBar active="learn" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  contentWide: { paddingHorizontal: 36 },
  loader: { marginVertical: 32 },
  pressed: { opacity: 0.7 },
  people: { gap: 16 },
  // The iPad's and desktop's cantors: 140pt medallions, 28pt apart, wrapping when there are many.
  peopleWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  continueList: { gap: 8 },
  continueCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 66,
    paddingHorizontal: 14,
  },
  continueNumber: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  continueNumberText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 14, fontWeight: '700' },
  continueInfo: { flex: 1, minWidth: 0 },
  continueTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  continueMeta: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 3 },
  resume: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
